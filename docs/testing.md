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
| `node tools/same.js --base REF` | A behavior-preserving change | The same runs from REF and from the working tree, compared leaf by leaf; nothing recorded; `--renamed OLD=NEW` reads a renamed field by its new name |

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

16 November (VB-856), after VB-853 to VB-856 moved the night's scripts back: `npm run verify` holds 172 scripts, 321 s of CPU over them
(the runner now prints each script's CPU and the sum: `tests/lib/runner.js` reads the children's CPU as each exits), 272 s of wall time
on a machine shared with other runs (load 10 to 30 on 4 cores), so a description; by the CPU alone, at least 80 s on 4 cores, over the
minute. The largest are not of the groups moved: `service` 7.4 s of CPU, `review-tools` 6.6, `spread` 6.2, `fish` 5.9, `format` 5.6,
`pot` 5.4. `tests/lint.js` fell from 7.4 s of CPU to 1.1 (the small islands for the keys of a world and a state, where it generated
the default island three times); the 23 scripts of VB-853 to VB-855 on the probe's islands from 64 to 53 s of CPU (VB-872's copies).
Before VB-853 to VB-856: verify 86 scripts in 35 s (2 min of CPU), the night's 53 scripts 245 s in the old verify.

22 November (VB-862): 220 scripts, 390 s of CPU run one at a time (361 s by the runner, 4 at a time) before, 301 s after. A full-size
map generated in a test is 2 s of CPU (280 by 200; 0.55 s at 120 by 85): eleven scripts moved to the probe's islands or its per-process
copies. Two caches, both keyed by content, so a warm run checks again only what changed: `tests/format.js` runs Prettier with its
`--cache` (node_modules/.cache/prettier), and `tools/writes.js` keeps each module's scan under node_modules/.cache/vb-writes, keyed
by the source, the module, the returns and the text of the scanner's own tools (`VB_NO_CACHE=1` skips it); `dependencies`,
`ownership`, `ownershiprules` and `review-tools` fell by 3 to 6 s each. A cold run (a fresh clone, CI) pays both once. Of what is left,
about half of a simulating script's CPU is V8 compiling on its background threads (the main thread's profile of `hay` is 2.4 of its
4.7 s); `--no-opt` and the like cut short scripts and slow long ones five times (`service` 7 s to 35 s), so none is set. Over 5 s of
CPU still: `accounts` 7.6, `review-tools` 6.1, `saves` 5.5, `notable` 5.1, `skip` 5.1, `hay` 5.0 (VB-1477).

22 November (VB-1477): verify 353 s of CPU to 280, one script at a time, measured twice in pairs with `main` on a machine 17% slower
than VB-862's (301 to 239 at its rate); 89 s to 70 s of wall time 4 at a time, 202 to 229 s one at a time. The lever is V8's: the
runner preloads `tests/lib/tiering.js` (NODE_OPTIONS `--require`, so the scripts' children have it too) in the fast and integration
tiers, which raises TurboFan's threshold from 3000 calls to 20000; a short run no longer pays the background compiler for functions it
calls too few times to repay. 165 of 220 scripts fell, none rose by more than half a second. The night's tier keeps V8's defaults, so the
bench and the bands measure the game as it runs; a script run by hand (`node tests/NAME.js`) does too. `accounts` compares its run with
the plain twin's at the first year's turn (the report's run goes on to its three years); `review-soil` is the soil half of `review-tools`.

## What runs only at night

53 scripts, moved as they are when verify was cut to scripts under 5 seconds; seconds each, measured inside the 245-second verify: `browser` 53,
`tools` 46, `saves` 43, `browser-saves` 42, `browser-start` 41, `smoke` 37, `populous` 34, `browser-editor` 34, `spread --extended` 26, `paths
--extended` 22, `clock --extended` 21, `indexes --extended` 20, `rivers` 20, `settle` 17, `stones` 16, `browser-mobile` 15, `browser-speed` 15,
`plans` 14, `record` 14, `layout` 14, `dig` 13, `offers` 12, `commands` 12, `review-tools` 12, `regress` 10, `owners` 10, `plaindata` 10, `kinlimit`
10, `hunger` 10, `meals` 10, `names` 9, `plots` 9, `stores` 9, `help` 9, `guardian` 9, `newfields` 8, `manual` 8, `herds` 8, `herding` 8, `kinship` 8,
`heirs` 8, `bench` 7, `geology` 7, `--expose-gc registry` 7, `hay` 6, `weeding` 6, `soil` 6, `notable` 6, `drying` 6, `byre` 6, `exchange` 6,
`occasions` 5, `forage` 5. With them the seven that were extended already (`start --people` 150, `bands` 50, `invariants` 44, `births` 38, `line` 32,
`history` 15, `fixtures` 5).

What a task no longer runs, until VB-409 and the tasks it was split into (VB-853 to VB-856) rebuild each on a small constructed state
(VB-853, VB-854 and VB-855 have rebuilt theirs, below):
- **The page at length.** `smoke` (jsdom, the tiny map) and the six Chromium scripts. A change under `src/page/` runs them by name;
  the lint still holds the page's contract (it only reads `st`), and `tests/speed.js`, `player.js` and `chronicle.js` its logic.
  Since VB-409 verify loads the page again: `tests/page.js` builds it in jsdom on a 36 by 26 island (a size the test adds to the
  page's own), starts founders from the address's hash, runs some days through the speed buttons and opens each panel once, in
  about 3 seconds (3.8 s here on a machine at load 12; 3.1 s of CPU). It and `smoke` share their harness, `tests/lib/dompage.js`,
  which fails on any error the page throws in a handler or a timer, not only on what it logs.
- **Land and geography, and the tools** (`rivers`, `stones`, `geology`, `layout`, `settle`, `plots`, `names`, `populous`, `tools`,
  `review-tools`, `bench`, `commands`, `record`, `regress`, `plaindata`, `--expose-gc registry`, `notable`, `manual`): since VB-856
  verify holds them again, on the small islands of `tests/lib/probe.js` (36 by 26, 48 by 34, and 60 by 44 where a test needs villages
  well apart or a village of 8 farms), in 1 to 4 seconds of CPU each; `review-hours` is the hours half of `review-tools`, apart, and `review-soil` its soil half (VB-1477). The
  islands are generated once per seed and size in a process and handed out as copies (VB-872, built with VB-856); `generate()` makes
  one anew where a test checks the generator's determinism. `tools/sim.js`, `balance.js` and `rules.js` take `--map probe`, the 36 by
  26 island. Four stay at night, saying so in their first lines: `rivers --extended` (the default island: ten sources or more, a course
  through a lake, more than 20 crossings), `layout --extended` (heirs three years and founders ten on the default island; red before and
  after VB-856, a green laid in play beside fields: VB-887), `populous --extended` (the four map sizes: the population each seeds and the
  village size bands) and `tools --extended` (the reports that take a run of their own each, and `tools/balance.js`). `stones` and
  `geology` lost their long runs. `help` (food help) is on the small island but stays at night: it is red since VB-461 (a kin gift is
  set aside and fetched, the test expects it at once), until VB-889.
- **The household's rules** (`meals`, `stores`, `hunger`, `heirs`, `guardian`, `kinship`, `kinlimit`, `owners`, `plans`, `offers`,
  `exchange`, `occasions`): since VB-854 verify holds them again, each on the small islands of `tests/lib/probe.js` (`scenario`), in
  1 to 5 seconds of CPU. What took years is constructed: the guardian's ward is brought to his eighteenth birthday by his birth date,
  where it took 14 years; the scarcity and plenty pulls on the marriage limit are read at one moving round on a pedigree laid over the
  heirs scenario's single adults (all first cousins, or strangers), where it took 8 years; `stores` reconciles founders three years and
  populous one. The scenes found on the 120 by 85 island are found again on the small ones (`offers`, seeds 42 and 13; `occasions`, 11).
  Two stay at night, saying so in their first lines: `heirs --extended` (the default island ten years on, and B3's lone holder bringing
  in a crop at four seeds, a statistic over seeds) and `hunger --extended` (three years of founders at seeds 7 and 42, reported).
- **The farming year** (`newfields`, `fieldswanted`, `weeding`, `soil`, `hay`, `byre`, `herds`, `herding`, `drying`, `forage`,
  `dig`): since VB-855 verify holds them again, on the small islands of `tests/lib/probe.js` (`island`, `scenario`), in 1 to 5
  seconds of CPU; `fieldswanted` never needed an island. The runs are cut to what the rule needs: weeding's year to the harvest, gathering's
  and drying's year and a half to the autumn and to winter day 6, digging's populous year to half of one (at seed 8: the small island at
  42 has no bog iron), populous's herds to the autumn count; the soil's ten years become a spring's carting, with every field's soil set
  below the cap a year on. One stays at night, saying so in its first line: `soil --extended` (founders ten years on the small map, the
  farms with cattle keeping their soil: a balance of a decade). Three were red on the run's branch and assert what it does: `hay`'s
  constructed barns had no farmstead since VB-255; `dig`'s urgency reads its job since VB-367; `drying`'s run no longer builds a boat
  (VB-393, VB-255: none in five years of founders or populous on the small island), so it counts boats, and the boat's building is its
  constructed scene.
- **Long save and load** (`saves`), and the generated-world cases of `clock`, `spread`, `paths` and `indexes` (`--extended`):
  since VB-853 verify holds them again, on small states, and only `paths --extended` stays at night. `saves` runs each scenario on a
  small generated island (36 by 26; heirs 48 by 34, which its two debug villages need; `tests/lib/probe.js`, `island` and
  `scenario`), loaded into the island generated again from the save, and the probe village saved mid-hour and mid-day. `clock
  --integration` runs the probe a year and a day by three chunk sizes, through every yearly entry of the calendar. `paths
  --integration` checks the scenarios' worn-in start and a populous season on the small islands, then lays lanes by hand round each
  house and green (and a green of open land) for the ways' rules. `indexes --integration` compares the indexes with full scans each
  season of the three scenarios and after deaths by `Sim.killPawn` that pass a holding on and end a household. `spread
  --extended` asserted what its probe case does, and was deleted with the long runs of the others. `paths --extended` keeps the
  default island's populous year: how many houses a year's traffic gives a way to their door is a statistic of a whole island.

A generated default island costs 1.8 s to make and a founders year on it 0.3 s; a 30 by 22 island 0.03 s and 0.13 s. The slow
scripts are slow from runs of years and from several islands, not from one generation, so no single switch makes them quick.

The PR workflow runs fast, then integration without rerunning fast, with no browser installed. Extended checks run nightly/manual,
with Chromium, logs and measurements uploaded as artifacts; they do not create PRs or change baselines automatically. A red night
is repaired by a task of its own.

## What moved, what changed

- The old default suite had 120 scripts and took about 294 seconds in the review environment (one dependency failure subsequently
  passed on rerun). Existing scripts remain inventoried; only `golden.js` and its permanent data are deleted.
- `clock`, `paths`, `indexes`, and `spread` have small default probes in `npm test`; `clock`, `paths` and `indexes` add their
  `--integration` case in verify (VB-853), and only `paths --extended` (the default island's populous year) stays in the **extended** tier.
- Index checks explicitly append children/unions, end a union, move a member and change a holder, comparing queries to independent scans.
- `continuity` compares independently constructed current runs, checks daily invariants, then compares JSON save/load continuation
  including modified world tiles. Generated-world continuation of each scenario is in `saves` (verify) and player continuity in `line`.
- `journeys` (VB-287) walks a move within a village and a bride's two-leg journey between two tiny villages with the page closed: legs
  at 6:00, stops on the route at 18:00, provisions out of the old household's store and no share of the new one's meal, a save on the
  road continued, a death on the road and an unprovisioned walk.
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
