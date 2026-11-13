# Testing during active development

Tests protect contracts, not yesterday's simulation outcomes. Permanent golden files and embedded story hashes are retired
(VB-408, 12 November 2026). Do not restore or regenerate them when behavior changes. This policy supersedes golden requirements
in older tasks, plans and surveys; those documents remain useful historical context.

## Commands and coverage

Kim, 13 November: the tests run for each task must be quick; a five-minute job is not workable. `npm run verify` is small targeted
scenarios, heavily constructed on the smallest states; the longer tests run at night.

| Command | When | Coverage |
|---|---|---|
| `npm test` | While editing, after each change (9 s) | Build, format (`tests/format.js`: Prettier over `src/`), lint/ownership/dependencies, backlog, representative rule/regression checks, tiny simulation invariants, determinism, JSON save/load continuity, scheduling, indexes and report calculations |
| `npm run verify` | Once, at the end of every task (35 s) | Fast plus integration: the other rule checks that run on small states in under 5 seconds each, and the small tools |
| `node tests/run.js integration` | CI after its fast job | Integration alone; avoids repeating the fast suite |
| `node tests/run.js extended` | At night; never part of a task | Everything long: generated islands and runs of years, the page in jsdom and all Chromium functionality, demography, daily multi-year invariants, late fixtures/history, bands, player-line continuity and the start screen's people table |
| `npm run nightly` | Scheduled or manual | Prepare all late fixtures once, extended, then bench and multi-seed band measurements |
| `node tests/NAME.js` | A change to what NAME covers | One script, whatever its tier: a page change runs `tests/smoke.js` and the `tests/browser*.js` it touches |
| `node tools/same.js --base REF` | A behavior-preserving change | The same runs from REF and from the working tree, compared leaf by leaf; nothing recorded |

`tests/suites.js` is the explicit inventory. `--list` prints per-script timings; `--verbose` includes full output and advisory
targets. Every suite reports its slowest five scripts.

**The rule for a new check.** Build it on a small constructed state (`tests/tiny.js`'s `tinyWorld` and `tinyState`,
`tests/lib/probe.js`): the households, fields and stores the rule needs, set by hand, and a few days of simulation at most. It goes
into fast or integration and takes under 5 seconds; the runner names a script over that (`over 5 s: ...`) without failing, and the
budgets are 30 seconds for `npm test` and a minute for verify, review budgets rather than wall-clock assertions. Only what needs a
whole generated island or a run of years goes to extended, and the rule it protects still gets its small case in verify.

## Measured (13 November 2026, 4 cores, Node 22)

| Run | Scripts | Wall clock | CPU | Result |
|---|---|---|---|---|
| Old default suite (the review's measurement) | 120 | 294 s | | |
| `npm test` | 44 | 9 s | 30 s | all pass; 7 targets out |
| `npm run verify` | 86 | 35 s | 2 min | all pass; 10 targets out, as on `main` |
| verify before the 5-second rule (integration held every generated scenario and the browsers) | 139 | 245 s | 12 min | all pass |
| `node tests/run.js extended`, fixtures made | 60 | 303 s | 16 min | all pass; 5 targets out |
| the small fixtures, when missing | | 222 s | | made once for the sources as they are |

Over 5 seconds in verify: `tests/lint.js` (6 to 7 s) and, on a loaded machine, `tests/fish.js` (5 s).

## What runs only at night

53 scripts, moved as they are when verify was cut to scripts under 5 seconds; seconds each, measured inside the 245-second verify: `browser` 53,
`tools` 46, `saves` 43, `browser-saves` 42, `browser-start` 41, `smoke` 37, `populous` 34, `browser-editor` 34, `spread --extended` 26, `paths
--extended` 22, `clock --extended` 21, `indexes --extended` 20, `rivers` 20, `settle` 17, `stones` 16, `browser-mobile` 15, `browser-speed` 15,
`plans` 14, `record` 14, `layout` 14, `dig` 13, `offers` 12, `commands` 12, `review-tools` 12, `regress` 10, `owners` 10, `plaindata` 10, `kinlimit`
10, `hunger` 10, `meals` 10, `names` 9, `plots` 9, `stores` 9, `help` 9, `guardian` 9, `newfields` 8, `manual` 8, `herds` 8, `herding` 8, `kinship` 8,
`heirs` 8, `bench` 7, `geology` 7, `--expose-gc registry` 7, `hay` 6, `weeding` 6, `soil` 6, `notable` 6, `drying` 6, `byre` 6, `exchange` 6,
`occasions` 5, `forage` 5. With them the seven that were extended already (`start --people` 150, `bands` 50, `invariants` 44, `births` 38, `line` 32,
`history` 15, `fixtures` 5).

What a task no longer runs, until VB-409 rebuilds each on a small constructed state:
- **The page.** `smoke` (jsdom) and the six Chromium scripts. A change under `src/page/` runs them by name; the lint still holds
  the page's contract (it only reads `st`), and `tests/speed.js`, `player.js` and `chronicle.js` its logic.
- **Rules asserted only on generated islands**: among them `meals`, `stores`, `heirs`, `plans`, `offers`, `hunger`, `herds`,
  `settle`, `layout`, `commands`, `record`, `plaindata`. A change to one of these systems runs its script by name.
- **Long save and load** (`saves`), and the generated-world cases of `clock`, `spread`, `paths` and `indexes` (`--extended`);
  their small cases stay in `npm test`.

A generated default island costs 1.8 s to make and a founders year on it 0.3 s; a 30 by 22 island 0.03 s and 0.13 s. The slow
scripts are slow from runs of years and from several islands, not from one generation, so no single switch makes them quick.

The PR workflow runs fast, then integration without rerunning fast, with no browser installed. Extended checks run nightly/manual,
with Chromium, logs and measurements uploaded as artifacts; they do not create PRs or change baselines automatically. A red night
is repaired by a task of its own.

## What moved, what changed

- The old default suite had 120 scripts and took about 294 seconds in the review environment (one dependency failure subsequently
  passed on rerun). Existing scripts remain inventoried; only `golden.js` and its permanent data are deleted.
- `clock`, `paths`, `indexes`, and `spread` have small default probes and retain generated-world coverage through `--extended`
  in the **extended** tier. The flag selects the larger case; it is distinct from the runner's long-duration `extended` tier.
- Index checks explicitly append children/unions, end a union, move a member and change a holder, comparing queries to independent scans.
- `continuity` compares independently constructed current runs, checks daily invariants, then compares JSON save/load continuation
  including modified world tiles. Longer generated-world continuation remains in `saves` and player continuity in `line`.
- `reports` exercises hunger/season/quantile math on deliberate data plus one CLI JSON check. `tools` retains full report integration.
- `rng` tests independent streams without first generating and advancing a world for a year.
- `cowwant` (VB-390) checks a household's want of a cow on the probe village: the deal booked as goodwill, kin's heifer at a marriage,
  and the animal moving only once a member has taken the job that leads it home.
- Calendar checks enforce essential ordering (food sharing before consumption/take-in; path changes before route refresh), not note
  text or a snapshot of every entry. `spread` tests phases and saves between them. Path thresholds are read from current tunables.
- `record` no longer asserts a particular number/hash of life stories. It checks event indexing and retains its long event/folding checks.
- Counter probes require finite nonnegative values, not that every kind of activity happens in one village. Explicit route counting,
  reset and save-exclusion checks remain; counter and scaling measurements remain advisory.
- Long `births`, `invariants`, `fixtures`, `history`, `bands` and `line` runs move to extended, and so does `start.js --people`
  (150 s: every scenario seeded at nine seeds on each of four map sizes, to compare the start screen's table of people). All other
  former generated scenarios were first kept in integration (verify then took 245 s) and went to extended with the 5-second rule. `health` (3 s) stays in integration; `hunger` (10 s) runs at night with the others over 5 seconds.
- `tests/hunger.js` failed on `main` (`fa732b7`) and in the first extended run: since VB-119 a household with no meals eats its grain
  uncooked, `ECON.rawGrain` (1.25) of grain a ration, and the test still fed 1.2 of grain as 1.2 rations and expected one ration
  to cost 1 of grain. The test now states its amounts in rations times `rawGrain`. No gameplay or tuning changes are made.
- `tools/same.js` replaces the golden file's use for refactors (below). Its first run compared this branch with `main`:
  `same: the world and the state at seeding and each year's end, founders, heirs at seeds 7, 42, tiny, 2 years, against fa732b7`.

## Failures and limits

Only exit code zero is success. Signals, spawn failures, timeouts, assertions, missing required fixtures and measurement execution
errors fail the command. A reported target outside its range does not fail it. Do not raise targets or refresh baselines to conceal
an excess. Existing lint and ownership ratchets remain enforced.

`VB_TEST_JOBS` must be a positive integer; the default uses available CPU parallelism. All `browser*.js` tests share one lane.
`VB_TEST_TIMEOUT_MS` must be a positive integer; the default is two minutes per fast script and fifteen minutes per other script.
These are generous hang limits, not speed benchmarks. On POSIX, timeouts terminate the process group and force-kill surviving
children after a short grace period. Windows falls back to terminating the direct child.

## Behavior-preserving refactors

Use focused tests for the affected contract and run verification. For simulation equivalence, `node tools/same.js --base REF`
(REF the commit the work started from; default `HEAD`, the uncommitted work against the last commit) checks out REF as a temporary
worktree, runs the same scenarios from both trees (default founders and heirs, seeds 7 and 42, the tiny map, 2 years: about 10
seconds; `--map medium --years 3` is what the golden file ran) and compares the generated world and the state at seeding and each year's end, leaf by leaf. It prints `same: ...`, or
each differing key with its first leaves (`pawns[41].household: 7 → 9`) and exits 1; `--keep DIR` keeps both sides. Where the
representation changed on purpose, the keys it names are the ones to explain. Put its command and its line in the PR. Nothing is
recorded and there is no `--update`: this is evidence for one change, not a baseline to approve repeatedly.

For intended behavior changes, assert the new rule on deliberate input and report relevant scenario measurements. Do not assert
historical API lists, event wording, random population counts or entire state fingerprints merely because they currently match.
