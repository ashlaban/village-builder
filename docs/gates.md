# Gates and targets

> Testing policy updated by VB-408 (12 November 2026): [Testing](testing.md) supersedes the golden-file,
> suite membership and CI requirements below. There are no permanent behavior baselines to update.
> Refactors preserve behavior through focused contracts and `tools/same.js` against their starting commit.
> Late fixtures and long measurements run in the extended/nightly tier, not routine PR verification.


VB-261, 10 November 2026, at `aea615a`. Kim, the same day: "We need to rethink the gates. We can't have hard gates in this phase of
development. Targets (and their residuals) are good however." This survey lists every check that can stop a task or a merge today, proposes
for each whether it stays a hard check (it fails a run) or becomes a target (it reports a measured value, its target and the residual, and
never fails), and proposes how targets are recorded and read. It changes no test, baseline or workflow; the questions are in
`QUESTIONS.md` ("VB-261") and the tasks that build the answers wait for them.

**Since then (Kim, 12 November).** Only island-wide numbers are judged, and hunger is an engine (`design.md`, Balance loops and
targets). Rows 21 and 22 below are as surveyed; today the bands' targets are growth over a scenario's seeds (the median at least 1% a
year, three seeds in four above their start, at most one in eight halved; founders at sixteen seeds, populous at four, the reduced
run), no village emptied, and the watched bands. Hunger's share of deaths and the hungry households are described: printed and
recorded, with no target (`tests/lib/bands.js`). A target that is out is left for a tuning run Kim starts, unless it is a collapse
(a median seed that shrinks).

**The dividing line.** A hard check guards correctness: something is true or false, it is the same on every machine and every run, and the
fix is in the change that broke it (a stale build, a clock in a module, a save that does not load back, an owner bypassed, a broken
invariant, an unlisted behaviour change). A target is a quantity we steer towards: cost, balance, demography, timing. Its value moves
with behaviour that is meant to change, with the fixtures, the seeds and the machine, and the change that moves it is often not the one
that can close it. Four failures of 10 November were of the second kind and all were handled the same way, by loosening or stopping:
PR 96's `tests/history.js` failed on `main` with seven ratios over the line and three ceilings were added to `tests/cost-baseline.json`
to let it pass; VB-201 stopped on a 5% relative gate over 8 women in 204; VB-227 could not show a 3 ms cut on a bench that varies 146 to
211 ms a day; the reduced bands' hungry-household range went from 0.6 to 0.8 to fit one heir.

## 1. The gates today

"At `aea615a`" is the result of running it here (Node 22, 4 cores, the local fixtures of `d196f68`, stale against the golden hash and
used as saved). `tools/bench.js` and `tools/bands.js` were not rerun (minutes and 15 to 20 minutes): their columns give the last record in
`docs/bench/` (both at `bcd9bf2`, 10 November, before VB-201's spread). Proposal: **hard** stays a failing check; **target** reports.

| # | Check | What it asserts | Threshold, and where it lives | Runs in | At `aea615a` | Proposal |
|---|---|---|---|---|---|---|
| 1 | `build.py --check` | `index.html` is built from `src/` | exact | test | pass | hard: a stale page is a wrong page |
| 2 | `tests/lint.js`, rules | `@sys` line, no clock or `Math.random` in modules, page writes only its flags | exact; `// lint-allow:` per line | test | pass | hard: determinism and the page's contract |
| 3 | `tests/lint.js`, sizes | no line over 160 characters; a module over 400 lines needs an open task that splits it (VB-413, VB-414, 13 November) | `tests/lint-baseline.json`: long lines, and `src/gen.js` kept at 545 lines; only falls | test | pass | the columns hard while cheap to meet (`tools/wrap.js`); the split task hard, since opening one is always possible; until VB-381's falling baselines for exports and function length |
| 3b | `tests/lint.js`, width | a module over 15 exports gains one only with an open task that splits it (VB-415, 13 November); the `sim` facade is not counted | `tests/width-baseline.json`, 21 modules at their counts, only falls | test | pass | hard, since opening the task is always possible; a function's length waits for VB-381 |
| 4 | `tests/ownership.js` (and `ownershiprules`, `cacheowners`) | only an owned field's owner writes it | `src/owners.json`; `tests/ownership-baseline.json`, 1 site left, only falls | test | pass | hard: architecture correctness, no noise |
| 5 | `tests/dependencies.js` | no lookup into a later module but command dispatch | exact | test | pass | hard |
| 6 | `tests/backlog.js` and the tool tests | backlog tables agree with task files; tools behave | exact | test | pass | hard |
| 7 | Determinism and state: `rng`, `plaindata`, `codec`, `record`, `commands`, `registry`, `spread`, `skip` | seeded streams, plain data, the record's calls, verbs | exact | test | pass | hard |
| 8 | Rules and systems: some 60 scripts (`heirs`, `meals`, `claims`, `routes`, `speed`, `bench`, `populous`...) | each rule on constructed cases; tools' math; the generator's statistics at fixed seeds | exact, or within 3 standard errors at fixed seeds (`populous`) | test | pass | hard: deterministic, a failure is a bug or an intended change re-recorded in the test |
| 9 | `tests/golden.js` | the generated world, twelve snapshots and calibration hash as recorded | `tests/golden.json`, re-recorded only for an intended change, entries listed in the PR | verify (and before every last commit) | pass | hard, as it is: it fails on an unlisted change, not on a change |
| 10 | `tests/saves.js`, `tests/browser-saves.js`, `tests/invariants.js`, `tests/fixtures.js` | a saved run goes on as the unsaved one; invariants hold daily; late saves load and hold | exact | verify | pass | hard |
| 11 | Page: `smoke`, `browser`, `browser-speed`, `browser-mobile` | the page works in jsdom and Chromium; pacing with a controlled clock | functional, no timing budget | verify | pass | hard |
| 12 | `births`, `hunger`, `health` | rules asserted; 50-year numbers reported | rules exact; numbers not asserted | verify | pass | hard for the rules; their reports become target records where a band names a range |
| 13 | `tests/counters.js`, structure | every counter exercised, none in saves, route counts exact | exact | test | pass | hard |
| 14 | `tests/counters.js`, values | each counter per living pawn-day on the tiny probe within ±10% of `tests/counters.json` | ±10%, both ways, in the test; `--update` re-records, listed in the PR | test | pass | target, one-sided: over +10% is a residual; a fall is good news, re-recorded with the golden file |
| 15 | `tests/scaling.js`, structure | the probe exercises every counter | exact | test | pass | hard: an unexercised counter is a broken test |
| 16 | `tests/scaling.js`, exponent | work per day from 2 to 4 villages grows with exponent at most 1.15 | `LIMITS.scaling` in `tests/lib/cost.js`; three ceilings in `tests/cost-baseline.json` (routeExpand 1.18, routeRefresh 1.74, roundPairs 2.00) | test | pass, with the three ceilings | target: the ceilings are residuals recorded as permissions |
| 17 | `tests/history.js`, counters | work per living pawn-day, `small-y40` over `small-y5`, at most 1.25 | `LIMITS.history`; six ceilings in `tests/cost-baseline.json` (routeExpand 1.26, routeRefresh 1.81, roundPairs 1.33, and since 10 November oppAsk 1.35, planReview 1.34, cookFarm 1.39) | verify | **fails**: see below | target: depends on fixtures that move with behaviour; it failed on `main` on 10 November |
| 18 | `tests/history.js`, timings | wall-clock ratio and the 60 ms step at `small-y40` | 1.25 and 60 ms, in roadmap 5.2 | verify | reported only | target (as now) |
| 19 | `tests/cost-baseline.json` ratchet (`tests/cost-rules.js`) | a ceiling may only fall, never be added by `--update`; every counter checked | the file | test | pass | the ratchet goes: ceilings become the residuals' first records; `cost-rules.js` tests the reporter instead |
| 20 | `tests/bands.js`, invariants band | no invariant violation at a year end, reduced runs | 0, `tests/lib/bands.js` | verify | pass | hard |
| 21 | `tests/bands.js`, balance bands | populous tiny, 8 years, seeds 3, 7, 11, 42: population ratio at least 1, no village emptied, hunger deaths at most 10%, worst hungry household at most 80% | `FLOORS` and their `reduced` ranges in `tests/lib/bands.js` (loosened from 2% and 30% for the reduced run) | verify | pass; at 30% seeds 3 (0.48) and 42 (0.46) would be out | target: these are balance, and the reduced ranges were widened to keep them passing |
| 22 | `tools/bands.js`, full runs | the same floors at full strength, populous and founders small (4 seeds), heirs (2) | `tests/lib/bands.js`; appended to `docs/bench/bands.jsonl` | by hand, nightly | 17 of 50 out (`bcd9bf2`): hunger deaths and hungry households on all three runs, population on heirs | target (already: "never failing") |
| 23 | `tools/bench.js`, the budget lines | mean 200 ms a game day, no step over 60 ms, save and load 0.5 s, gzip 10 MB, at `medium-ref` | roadmap 5.2; `LINES` in `tools/bench.js`; `docs/bench/budget.md` | by hand, nightly | `bcd9bf2`: mean 177 in; longest step 84.7 out; save 852 and load 631 ms out; gzip in | target (already reported) |
| 24 | `tools/bench.js`, system shares | each system's ms a game day within its share of 192 | `SYSTEM_BUDGETS` in `tools/bench.js`; `docs/bench/closure.md` | by hand, nightly | `bcd9bf2`: 9 of 15 over (largest: idle strolls 35.9 of 33, agents walking 26.6 of 23) | target |
| 25 | `tools/bench.js`, drift flag | a measure 20% over the median of the last five runs | `flags()` in `tools/bench.js` | nightly | reported | target (a residual against the recent past, not a line) |
| 26 | The demographic gate | populous small, 30 years, seeds 1 to 12: marriages a year and first-marriage age within 5% of before, never-married women 45 to 54 within 2 points | the criteria of VB-196 and VB-201, `tools/marriage-demography.js` | by hand, per task | passed in VB-201 after Kim's second answer | target, with the spread over seeds as its noise |
| 27 | Customs calibration | first flips of customs in design's bands | `npm run calibrate`; design.md | by hand | not run here | target (already reported) |
| 28 | Acceptance criteria worded as lines | "at most 30 ms" (VB-227), "under 0.5 s" (VB-226, VB-215), "under 60 ms" (VB-215), "within 1%" (VB-078), "`npm run verify` passes" (VB-240, VB-257) | each task file | per task | VB-227 and VB-201 stopped on them | a cost or balance line becomes "towards the target; residual reported"; "verify passes" means its hard checks |
| 29 | "A task is not done until the Checks pass" | the refactor rules ("the PR's Checks pass"), AGENTS.md's taking a task | `BACKLOG.md`, "How this backlog works"; `AGENTS.md` | process | Checks off for PRs since 10 November | a task is done when its hard checks pass and its targets are reported |
| 30 | `.github/workflows/checks.yml` | verify without fixtures; `tests/fixtures.js` and `tests/history.js` on the published fixtures | the workflow | by hand since 10 November | not run | back on PRs, failing only on hard checks, targets printed in the job summary |

**`tests/history.js` at `aea615a`.** `npm run verify` passes but for this script (397 s; `npm test`, 86 scripts, passes). Seven ratios
fail, the same as in VB-201's and VB-227's notes: routeExpand 1.462 (ceiling 1.257), routeRefresh 1.856 (1.813), walkTies 1.436,
roundPairs 10.24 (1.326), heirRank 1.473, recordFold 1.558, roundRank 1.414 (limit 1.25 where no ceiling); oppAsk 1.354, planReview
1.342 and cookFarm 1.386 pass only by the ceilings written on 10 November. Its timings, reported only: 0.351 and 0.349 ms a living
pawn-day (ratio 0.99, from the windows it prints; the failed assertion stops it before its own line), and a longest step of
143.7 ms at `small-y40` against the 60 ms line.
`tests/scaling.js` passes with its three ceilings (roundPairs at exactly 2.00, its ceiling).

Of the 30 rows, 15 are proposed to stay hard (rows 1 to 13, 15 and 20); 13 become targets (14, 16 to 19, 21 to 28, six of them
reported already and targets in all but name); 2 are process rules (29, 30) reworded around the hard checks. The borderline ones:
- **Counters (row 14).** They are exact, so no noise: a counter moves only when work or behaviour moves. But work is meant to move, and
  the golden file already stops an unlisted behaviour change. The ±10% catches a loop that does more work than before, which is a target's
  question ("is it worse, by how much?"), and a fall of more than 10% fails today too. Report it one-sided; keep `--update` with the list.
- **Bands' asserts (row 21).** The reduced runs are balance probes; their ranges were already widened twice to keep verify green. As
  targets they can keep the full-strength ranges (2% and 30%) and show the residual honestly: at `aea615a` the worst hungry household
  is 0.48 (seed 3) and 0.46 (seed 42), residuals of 0.18 and 0.16, where today they pass under 0.8. The invariants band stays hard: it is
  correctness, and it is also checked daily by `tests/invariants.js`.
- **Scaling exponent (row 16).** Deterministic and cheap, so it could stay hard; but its three ceilings show what happens to a hard cost
  line that cannot be met at once: the excess is written down as an allowance. As a target the 1.15 stays the line and 2.00 is a residual.
- **Baselines that only fall (rows 3, 4, 19).** Lint and ownership stay ratchets: they count sites of a rule, a new site is a change's own
  doing, and the fix is in that change. The cost baseline is different: its "sites" are ratios on fixtures that move with every behaviour
  change, so a change can push one over without adding work of its own (PR 96: seven over on `main`). It stops being a ratchet.
- **The golden file (row 9).** Stays hard because it is cheap to satisfy: a deliberate change is re-recorded and listed. It is a record
  of what changed, not a line to meet.

## 2. The mechanism

**A target record.** One line of JSON per target per run:
`{name, where, unit, dir, target, measured, residual, noise, status, commit, dirty, date, machine}`, where `name` is stable
(`history/routeRefresh`, `bench/medium-ref/mean`, `bands/hunger-deaths/populous`, `demography/never-married`), `where` the fixture or
scenario and seeds, `dir` is `max`, `min` or `range`, `residual` is how far past the target, signed so that positive is worse (0 when in),
`noise` is `{kind: exact|seeds|runs|paired, spread, n}`, and `status` is `in`, `out`, or `noise` (out by less than the noise).

**Where they live: options.**
- A. Printed only: each test prints `TARGET name measured target residual status` and the runner counts them. No history. Cost: a few
  lines a test; nothing else. Residuals are lost once the PR is merged.
- B. **One file, `docs/bench/targets.jsonl`, beside `bands.jsonl` and `history.jsonl`**, appended by the tools that already append
  (bench, bands) and by the tests when run with `--record` (the nightly, and by hand); printed always. A small reader,
  `node tools/targets.js [--name PATTERN] [--since DATE]`, prints the latest value of each target with its residual and the last five, and
  rewrites `docs/bench/targets.md` (a table, as `budget.md` is generated). Cost: one shared reporter (`tests/lib/targets.js`, some 60
  lines) and one reader tool (some 100 lines), then a small change to each check that becomes a target. Size S each.
- C. B, with the nightly workflow committing `targets.jsonl` back to a branch, so main's history holds every night. Cost: B plus
  workflow work and a branch to keep; worth it only once the nightly runs reliably (VB-225).

**Recommendation: B**, with the record above. A residual is read over time from the file; `targets.md` is what a person reads.
`tests/cost-baseline.json` is retired: its ceilings become the first records. `closure.md` stays the hand-written table that names the
task closing each gap, and gains the targets out that have no task.

**How a check reports without failing.** As `tools/bands.js` does: print each target as in or out, exit 0. In `tests/run.js` a script
that prints `TARGET` lines is summarised as `verify: 101 passed; 8 targets out (history/routeRefresh +0.56, ...)`, so a run that passes
still shows its residuals in one line. A target never sets the exit code; a script's hard assertions in the same file still do.

**Noise.** Counters are exact (noise 0): any residual counts. Seeded balance and demography take their noise from the seeds: the
standard error of the mean over the seeds, and a residual within twice that is `noise`, not `out` (VB-201's 8 women in 204 was well
inside it). Timings use VB-227's finding: on this machine the whole step varied 146 to 211 ms a day between runs of the same code, while a
system's share of the whole moved by a point. A timing target is compared (1) as the share of the whole step in the same run, and (2) in
paired, alternated runs of before and after, three each, reporting the median and the range; a residual inside the range of the
"before" runs is `noise`. The 200 ms and the shares stay in ms on the nightly machine, read over many nights, not from one run.

**What a PR and a task file say.** A section "Targets" with one line per target the change moves or was meant to move: before, after,
the residual, and whether the change is its cause. Targets out before and not moved are summed in one line ("8 targets out, as on
`main`"). A change never raises a target or writes an allowance to make a residual vanish; a target is changed only by Kim, as the
budget's lines are. A task whose criterion is a target is done when it has moved towards it and reports the residual; if one remains, the
task names who closes it (a task, a question, or `closure.md`).

**What still stops a merge.** Only the hard checks: a red `npm test`, or a hard script of verify (golden unlisted, saves, invariants,
fixtures loading, the page). Checks come back on pull requests running exactly those, with targets printed in the job summary
(`$GITHUB_STEP_SUMMARY`), never failing on them.

## 3. What should change elsewhere (not edited here)

- `AGENTS.md`: Working rules, "until VB-261 says how": replace with the PR's Targets section and the rule that targets never fail and
  are never raised to hide a residual; Commands: `tools/targets.js` and `targets.jsonl`; Cost growth: `tests/scaling.js` and
  `tests/history.js` report targets, and "`--update` only lowers excesses" goes; Taking a task, step 5: "report the targets out".
- `docs/roadmap.md`, section 5.2: the lines are targets with residuals, read nightly; the history line 1.25 and the 60 ms step stay as
  targets. Section 6: the work counters and the scaling exponent are "reported with tight targets", not "asserted with tight bands";
  "Where it runs" gains the targets file.
- `BACKLOG.md`, How this backlog works: the refactor rules' "the PR's Checks pass" becomes "the hard checks pass"; "Golden file, work
  counters and cost growth" says counters and cost growth are targets.
- `design.md`: nothing; the gates are process, not design. `docs/bench/closure.md`: a column for the target's name in `targets.jsonl`.
- `.github/workflows/checks.yml`: on pull requests again, hard checks only (a follow-up task, if Kim agrees).

## 4. The tasks, each waiting for Kim's answers

| Task | What | Waits for |
|---|---|---|
| VB-262 | the record, `docs/bench/targets.jsonl`, `tools/targets.js` and `targets.md`; the runner's summary of targets out | Kim |
| VB-263 | `tests/scaling.js` and `tests/history.js` report targets; `tests/cost-baseline.json` retired | VB-262, Kim |
| VB-264 | `tests/counters.js` and the reduced bands report targets; their structure and the invariants band stay hard | VB-262, Kim |
| VB-265 | `tools/bench.js`, `tools/bands.js` and `tools/marriage-demography.js` write records, with noise; paired runs | VB-262, Kim |
| VB-266 | Checks back on pull requests, hard checks only | VB-263, VB-264, Kim |
| VB-267 | `AGENTS.md`, roadmap 5.2 and 6, `BACKLOG.md` and the open tasks' criteria brought in line (section 3) | VB-263, Kim |
| VB-268 | recordFold, the one history excess with no ceiling and no task | Kim |
